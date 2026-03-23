interface ReviewIndicatorProps {
  show: boolean;
}

export function ReviewIndicator({ show }: ReviewIndicatorProps) {
  if (!show) return null;

  return (
    <span
      className="inline-block size-2 rounded-full bg-primary"
      title="Needs review"
    />
  );
}
