import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';

/**
 * Reusable confirmation dialog for destructive actions.
 * Drop-in replacement for window.confirm() with styled UI.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     onOpenChange={setShowConfirm}
 *     title="Delete job posting?"
 *     description="This action cannot be undone."
 *     confirmLabel="Delete"
 *     variant="destructive"
 *     onConfirm={() => deleteJob(id)}
 *   />
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive', // 'destructive' | 'default'
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl bg-card border-border max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-['Outfit']">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`rounded-xl ${
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
