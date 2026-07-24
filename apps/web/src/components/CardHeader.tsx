import StartIcon from "@/assets/icons/star.svg";
import { twMerge } from "tailwind-merge";

export const CardHeader = ({
  title,
  description,
  className,
  indication,
}: {
  title: string;
  description: string;
  className?: string;
  indication?: string;
}) => {
  return (
    <div className={twMerge("flex flex-col p-6 md:py-8 md:px-10", className)}>
      <div className="inline-flex gap md:gap-2 ">
        <StartIcon className="size-9 text-emerald-300" />
        <h3 className="font-serif text-3xl text-center md:text-left">
          {title}
        </h3>
      </div>
      <p className="flex flex-col gap-3 text-sm text-center md:text-left md:pl-9  lg:text-base lg:max-w-lg text-white/60 mt-2">
        {description}
        <span className="text-xs">{indication}</span>
      </p>
    </div>
  );
};
