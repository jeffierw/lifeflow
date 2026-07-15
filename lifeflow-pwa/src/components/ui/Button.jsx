import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-[#ff8c42] text-white hover:bg-[#e07a36] shadow-md hover:shadow-lg",
        destructive: "bg-[#ff6b6b] text-white hover:bg-[#ee5a5a] shadow-md hover:shadow-lg",
        outline: "border-2 border-[#ffd4b8] bg-white text-[#3d3d3d] hover:border-[#ff8c42] hover:bg-[#fff8f0]",
        secondary: "bg-[#ffe8d6] text-[#3d3d3d] hover:bg-[#ffd4b8]",
        ghost: "hover:bg-[#ffe8d6] hover:text-[#3d3d3d]",
        link: "text-[#ff8c42] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export function Button({ className, variant, size, asChild = false, loading = false, children, onClick, type = "button", ...props }) {
  const Comp = asChild ? Slot : "button"

  const handleClick = (e) => {
    if (!loading && onClick) {
      onClick(e)
    }
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }), loading && "cursor-wait")}
      disabled={loading}
      onClick={handleClick}
      type={type}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />
          加载中...
        </span>
      ) : (
        children
      )}
    </Comp>
  )
}
