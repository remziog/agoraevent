import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          // Naz's toast: an ink card with paper text; errors keep their red.
          toast:
            "group toast group-[.toaster]:rounded-[18px] group-[.toaster]:border-0 group-[.toaster]:bg-[#100f0e] group-[.toaster]:text-[#f4efe7] group-[.toaster]:shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)]",
          description: "group-[.toast]:text-[#f4efe7]/75",
          actionButton: "group-[.toast]:bg-[#f4efe7] group-[.toast]:text-[#100f0e]",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-[#f4efe7]",
          error: "group-[.toaster]:!bg-[#c8321a] group-[.toaster]:!text-[#fbf8f3]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
