import { useEffect, useState } from "react";
import { fetchEventSource, EventStreamContentType } from "@microsoft/fetch-event-source";
import toast from "react-hot-toast";
import BASE_URL from "../../../app/config";
import { setReady } from "../../../app/slices/ui";
import {
  fillChannels,
  addChannel,
  removeChannel,
  updateChannel,
  updatePinMessage
} from "../../../app/slices/channels";
import {
  updateUsersVersion,
  updateReadChannels,
  updateReadUsers,
  updateMute
} from "../../../app/slices/footprint";
import { updateUsersByLogs, updateUsersStatus } from "../../../app/slices/users";
import { resetAuthData } from "../../../app/slices/auth.data";
import chatMessageHandler from "./chat.handler";
import store, { useAppDispatch, useAppSelector } from "../../../app/store";
import { ServerEvent, UsersStateEvent } from "../../../types/sse";

class RetriableError extends Error {}

class FatalError extends Error {}

const getQueryString = (params: { [key: string]: string }) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val) {
      sp.append(key, val);
    }
  });
  return sp.toString();
};
let inter: number | null = null;

export default function useStreaming() {
  const [readyPullData, setReadyPullData] = useState(false);
  const {
    authData,
    ui: { ready, online },
    footprint: { afterMid, usersVersion, readUsers, readChannels }
  } = useAppSelector((store) => store);
  const dispatch = useAppDispatch();
  const loginUid = authData.user?.uid || 0;
  let initialized = false;
  let initializing = false;
  let controller = new AbortController();

  const startStreaming = async () => {
    console.info("sse start streaming", initialized, initializing);
    if (initialized || initializing) return;
    // 如果token快要过期，先renew
    const {
      authData: { token = "" }
    } = store.getState();

    // 开始初始化
    initializing = true;
    const params: {
      "api-key": string;
      after_mid?: string;
      users_version?: string;
    } = {
      "api-key": token
    };
    // 如果afterMid是0，则不传该参数
    if (afterMid !== 0) {
      params.after_mid = `${afterMid}`;
    }
    // 如果usersVersion是0，则不传该参数
    if (usersVersion !== 0) {
      params.users_version = `${usersVersion}`;
    }
    await fetchEventSource(`${BASE_URL}/user/events?${getQueryString(params)}`, {
      openWhenHidden: true,
      signal: controller.signal,
      async onopen(response) {
        initializing = false;
        if (response.ok && response.headers.get("content-type") === EventStreamContentType) {
          console.info("sse everything ok");
          initialized = true;
          return; // everything's good
        } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          // 重新登录
          // client-side errors are usually non-retriable:
          console.info("sse debug: open fatal");
          throw new FatalError();
        } else {
          // server error
          console.info("sse debug: open retry");
          throw new RetriableError();
        }
      },
      onmessage(evt) {
        initializing = false;
        console.info("sse message", evt.data);
        // if the server emits an error message, throw an exception
        // so it gets handled by the onerror callback below:
        if (evt.event === "FatalError") {
          console.info("sse debug: error message fatal");
          throw new FatalError(evt.data);
        }
        const data: ServerEvent = JSON.parse(evt.data);
        const { type } = data;
        switch (type) {
          case "heartbeat":
            console.info("sse heartbeat", loginUid);
            break;
          case "ready":
            console.info("sse streaming ready");
            dispatch(setReady());
            break;
          case "users_snapshot":
            {
              console.info("sse users snapshot");
              const { version } = data;
              dispatch(updateUsersVersion(version));
            }
            break;
          case "users_log":
            {
              const { logs } = data;
              console.info("sse users change logs", logs);
              dispatch(updateUsersByLogs(logs));
            }
            break;
          case "user_settings":
          case "user_settings_changed":
            {
              console.info("sse users settings");
              Object.keys(data).forEach((key) => {
                switch (key) {
                  case "read_index_groups":
                    dispatch(updateReadChannels(data[key]));
                    break;
                  case "read_index_users":
                    dispatch(updateReadUsers(data[key]));
                    break;
                  case "add_mute_users":
                  case "mute_users":
                  case "add_mute_groups":
                  case "mute_groups":
                    {
                      const arr = data[key];
                      if (arr && arr.length) {
                        const _key = key.endsWith("users") ? "add_users" : "add_groups";
                        dispatch(updateMute({ [_key]: arr }));
                      }
                    }
                    break;
                  case "remove_mute_users":
                  case "remove_mute_groups":
                    {
                      const arr = data[key];
                      if (arr && arr.length) {
                        const _key = key.endsWith("users") ? "remove_users" : "remove_groups";
                        dispatch(updateMute({ [_key]: arr }));
                      }
                    }
                    break;

                  default:
                    break;
                }
              });
            }
            break;
          case "users_state":
          case "users_state_changed":
            {
              let { type, ...rest } = data;
              const onlines =
                type == "users_state_changed" ? [rest] : (rest as UsersStateEvent).users;
              dispatch(updateUsersStatus(onlines));
            }
            break;
          case "kick":
            {
              console.info("sse kicked");
              switch (data.reason) {
                case "login_from_other_device":
                  dispatch(resetAuthData());
                  toast("kicked from the other device");
                  break;
                case "delete_user":
                  dispatch(resetAuthData());
                  toast("Your account has been deleted");
                  break;
                default:
                  break;
              }
            }
            break;
          case "related_groups":
            console.info("sse fill channels from streaming", data);
            dispatch(fillChannels(data.groups));
            break;
          case "joined_group":
            console.info("sse joined group", data.group);
            dispatch(addChannel(data.group));
            break;
          case "group_changed":
            {
              const { gid, ...rest } = data;
              dispatch(
                updateChannel({
                  gid,
                  ...rest
                })
              );
            }
            break;
          case "user_joined_group":
            {
              console.info("sse new user joined group", data.gid);
              const { gid, uid: uids } = data;
              // 去重
              dispatch(
                updateChannel({
                  operation: "add_member",
                  gid,
                  members: uids
                })
              );
            }
            break;
          case "user_leaved_group":
            {
              const { gid, uid: uids } = data;
              if (uids.findIndex((uid) => uid == loginUid) > -1) {
                dispatch(removeChannel(gid));
              } else {
                dispatch(
                  updateChannel({
                    operation: "remove_member",
                    gid,
                    members: uids
                  })
                );
              }
            }
            break;
          case "kick_from_group":
            console.info("sse kicked from group", data.gid);
            dispatch(removeChannel(data.gid));
            break;
          case "pinned_message_updated":
            {
              // const {gid,mid,msg}=data;
              dispatch(updatePinMessage(data));
            }
            break;
          case "chat":
            {
              chatMessageHandler(data, dispatch, {
                ready,
                loginUid,
                readUsers,
                readChannels
              });
            }
            break;

          default:
            console.info("sse event data", data);
            break;
        }
      },
      onclose() {
        // if the server closes the connection unexpectedly, retry:
        console.info("sse debug: closed");
        initializing = false;
        throw new RetriableError();
      },
      onerror(err) {
        initializing = false;
        if (err instanceof FatalError || err.toString().indexOf("network error") > -1) {
          console.info("sse debug: error fatal", err);
          throw err; // rethrow to stop the operation
        } else {
          console.info("sse debug: error other", err);
          stopStreaming();
          if (inter) {
            clearTimeout(inter);
          }
          // 重连
          inter = window.setTimeout(() => {
            initialized = false;
            startStreaming();
          }, 2000);
          throw err; // rethrow to stop the operation
          // do nothing to automatically retry. You can also
          // return a specific retry interval here.
        }
      }
    });
    initializing = false;
    // for controlling
    return controller;
  };

  const stopStreaming = () => {
    console.info("sse stop streaming");
    if (controller && controller.abort) {
      controller.abort();
    }
  };

  const setStreamingReady = (ready: boolean) => {
    setReadyPullData(ready);
  };

  useEffect(() => {
    if (readyPullData) {
      if (online) {
        startStreaming();
      } else {
        stopStreaming();
      }
    }
    return () => {
      stopStreaming();
    };
  }, [online, readyPullData]);

  return {
    setStreamingReady,
    startStreaming,
    stopStreaming
  };
}
