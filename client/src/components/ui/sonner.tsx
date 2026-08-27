import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      richColors
      className="toaster group"
      toastOptions={{
        classNames: {
          success: "!border-[#a9d8b8] !bg-[#effaf2] !text-[#276749] [&_[data-icon]]:!text-[#2f855a]",
          error: "!border-[#f1b8b3] !bg-[#fff1f0] !text-[#9f2f2a] [&_[data-icon]]:!text-[#c63f38]",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
