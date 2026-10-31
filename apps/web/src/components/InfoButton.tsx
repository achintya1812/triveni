import { Dialog } from "@base-ui/react/dialog";
import { InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

// A small ⓘ that opens a short explainer, so the screen itself stays uncluttered.
export function InfoButton({ title, text }: { title: string; text: string }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={t("about", { title })} />}>
        <InfoIcon />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg bg-background p-5 shadow-lg">
          <Dialog.Title className="font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm">{text}</Dialog.Description>
          <Dialog.Close render={<Button variant="outline" className="h-11 w-full" />}>{t("close")}</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
