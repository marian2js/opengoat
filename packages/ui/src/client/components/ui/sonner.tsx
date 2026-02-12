import type { ReactElement } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps): ReactElement {
  return (
    <Sonner
      theme="dark"
      closeButton
      richColors
      position="top-right"
      {...props}
    />
  );
}
