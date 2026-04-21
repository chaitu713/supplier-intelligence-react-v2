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
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M8 10.5h8M8 14h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 12c0 4.418-3.582 8-8 8-1.11 0-2.167-.226-3.13-.635L4 20l.86-3.435A7.963 7.963 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
