interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function FloatingChatButton({ isOpen, onClick }: FloatingChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close Supplier Advisor AI" : "Open Supplier Advisor AI"}
      className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        background: "var(--primary)",
        color: "white",
        boxShadow:
          "0 18px 40px -18px color-mix(in srgb, var(--primary) 55%, transparent)",
      }}
    >
      {isOpen ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <AdvisorCompassIcon className="h-6 w-6" />
      )}
    </button>
  );
}

export function AdvisorCompassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 11.5c0 4.1-3.4 7.5-7.5 7.5-1 0-1.9-.2-2.8-.5L5 19l.9-3.4C5.3 14.5 5 13.5 5 12.5 5 8.4 8.4 5 12.5 5S20 8.4 20 11.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="12.5" cy="11.5" r="3.1" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12.5 8.8v5.4M9.8 11.5h5.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M12.5 11.5l1.9-1.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
