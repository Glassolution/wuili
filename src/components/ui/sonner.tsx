import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !w-screen !max-w-none !rounded-none !border-x-0 !border-t-0 !border-b !py-2.5 !px-6 !shadow-sm group-[.toaster]:bg-[#0f1117] group-[.toaster]:text-white group-[.toaster]:border-white/10 !justify-center !text-center flex items-center gap-3",
          description: "group-[.toast]:text-white/60 !text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon: "!text-emerald-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
