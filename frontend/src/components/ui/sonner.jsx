import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-[rgba(24,24,27,0.9)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:!border group-[.toaster]:!border-white/10 group-[.toaster]:!text-foreground group-[.toaster]:!shadow-[0_8px_32px_rgba(0,0,0,0.4)] group-[.toaster]:!rounded-2xl group-[.toaster]:!font-['DM_Sans',sans-serif]",
          description: "group-[.toast]:!text-muted-foreground",
          actionButton:
            "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground group-[.toast]:!rounded-xl group-[.toast]:!font-medium",
          cancelButton:
            "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground group-[.toast]:!rounded-xl",
          success:
            "group-[.toaster]:!border-emerald-500/20 group-[.toaster]:!shadow-[0_8px_32px_rgba(16,185,129,0.15)]",
          error:
            "group-[.toaster]:!border-red-500/20 group-[.toaster]:!shadow-[0_8px_32px_rgba(244,63,94,0.15)]",
          info:
            "group-[.toaster]:!border-blue-500/20 group-[.toaster]:!shadow-[0_8px_32px_rgba(99,102,241,0.15)]",
          warning:
            "group-[.toaster]:!border-amber-500/20 group-[.toaster]:!shadow-[0_8px_32px_rgba(245,158,11,0.15)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast }
