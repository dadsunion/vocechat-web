import { ChangeEvent, FC, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ChatContext } from "@/types/common";
import useUploadFile from "@/hooks/useUploadFile";
import AddIcon from "@/assets/icons/add.solid.svg";
import ExitFullscreenIcon from "@/assets/icons/fullscreen.exit.svg";
import FullscreenIcon from "@/assets/icons/fullscreen.svg";
import MarkdownIcon from "@/assets/icons/markdown.svg";
import SendIcon from "@/assets/icons/send.svg";
import Tooltip from "../Tooltip";

type Props = {
  sendMessages: () => void;
  toggleMarkdownFullscreen: () => void;
  fullscreen: boolean;
  toggleMode: () => void;
  mode: "markdown" | "text";
  to: number;
  context: ChatContext;
  sendVisible: boolean;
};
const Toolbar: FC<Props> = ({
  sendMessages,
  sendVisible,
  toggleMarkdownFullscreen,
  fullscreen,
  toggleMode,
  mode,
  to,
  context
}) => {
  const { t } = useTranslation();
  const { addStageFile } = useUploadFile({ context, id: to });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMarkdown = mode == "markdown";
  return (
    <div className={`flex  items-center justify-end gap-2.5`}>
      {!isMarkdown && (
        <>
          {sendVisible && (
            <Tooltip placement="top" tip="Send">
              <SendIcon
                className={"w-6 h-6 cursor-pointer animate-zoomIn fill-[#979797]"}
                onClick={sendMessages.bind(null)}
              />
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
};
export default Toolbar;
