/** Finestra di conferma per le azioni che fanno perdere qualcosa (riusabile, basata su Modal): il testo
 *  (`children`) dice che cosa si perde; «Conferma» procede, «Annulla» no. Esc, il clic sullo sfondo e la X
 *  della modale valgono come «Annulla». Sostituisce window.confirm, che non si può né stilizzare né testare.
 *  Ha il ruolo `alertdialog`: interrompe per chiedere una decisione su una perdita. */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({ title, onConfirm, onCancel, children }: {
  title: string; onConfirm: () => void; onCancel: () => void; children: ReactNode;
}) {
  return (
    <Modal title={title} label={title} width={420} role="alertdialog" onClose={onCancel}>
      {/* break-words: il testo contiene nomi scritti dall'utente, anche lunghi e senza spazi: vanno a capo invece di far scorrere la finestra */}
      <p className="break-words text-sm text-chalk">{children}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button onClick={onConfirm}>Conferma</Button>
      </div>
    </Modal>
  );
}
