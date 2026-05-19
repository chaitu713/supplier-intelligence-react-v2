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
      className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #1a7a3e 0%, #166534 100%)",
        color: "white",
        boxShadow: isOpen
          ? "0 8px 24px -4px rgba(22, 101, 52, 0.4)"
          : "0 12px 28px -8px rgba(22, 101, 52, 0.45), 0 4px 12px -2px rgba(22, 101, 52, 0.2)",
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
          style={{ transition: "transform 0.2s ease" }}
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
        d="M12 5V3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 9.5A3.5 3.5 0 0 1 10.5 6h3A3.5 3.5 0 0 1 17 9.5v4A3.5 3.5 0 0 1 13.5 17h-3A3.5 3.5 0 0 1 7 13.5v-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="11" r="1" fill="currentColor" />
      <circle cx="14" cy="11" r="1" fill="currentColor" />
      <path
        d="M10 14h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 12h3M17 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1" fill="currentColor" />
    </svg>
  );
}
