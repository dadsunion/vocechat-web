// import { useEffect } from "react";
import { useTranslation } from "react-i18next";
// import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
// import { resetAuthData } from "@/app/slices/auth.data";
import Button from "@/components/styled/Button";
// import useLogout from "@/hooks/useLogout";

type Props = {
  placement?: "session" | "chat";
};

const LoginTip = ({ placement = "chat" }: Props) => {
  const { t } = useTranslation("welcome");
  const { t: ct } = useTranslation();
  // const dispatch = useDispatch();
  // const { clearLocalData } = useLogout();
  const navigateTo = useNavigate();
  const handleSignIn = () => {
    // dispatch(resetAuthData());
    // clearLocalData();
    // navigateTo("/login");

    window.postMessage("login_request", "*");
  };

  return (
    <div
      className={clsx(
        "flex justify-between align-center gap-2 w-full bg-[white] shadow-[0px_-4px_10px_0px_rgba(0,0,0,0.1)] px-3 py-2",
        // "flex items-center justify-between bg-slate-200/80 dark:bg-gray-800 rounded-lg py-2 px-3 border border-solid border-gray-200 dark:border-gray-500",
        placement == "session"
          ? "!w-[96%] md:hidden fixed bottom-2 left-1/2 -translate-x-1/2"
          : "w-full"
      )}
    >
      <div className="w-full text-xs text-[rgb(207,207,207)] px-3 py-2 bg-[rgb(243,243,243)] rounded-[50px]">
        {/* {t("sign_in_tip")} */}
        登陆后才可以发言哦~
      </div>
      <Button
        onClick={handleSignIn}
        className="mini bg-[#385CF4] hover:bg-[#385bf4c3] active:bg-[#385bf4c3]"
      >
        登录
      </Button>
    </div>
  );
};

export default LoginTip;
