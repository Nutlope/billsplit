export default function Footer() {
  return (
    <footer className="w-full flex flex-col sm:flex-row justify-center items-center py-4 gap-4 mt-auto">
      <p className="text-xs font-medium text-center mb-2 sm:mb-0 sm:mr-2">
        <span className="text-[#99a1af]">Powered by </span>
        <a
          href="https://togetherai.link/?utm_source=billsplit&utm_medium=referral&utm_campaign=example-app"
          target="_blank"
          className="text-[#4a5565] underline"
        >
          Together.ai
        </a>
      </p>
      <div className="flex gap-2">
        <a
          href="https://github.com/nutlope/billsplit"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center items-center w-5 h-5 rounded bg-white border-[0.3px] border-[#D1D5DC]"
        >
          <svg
            width={12} // Adjusted size for better fit
            height={12} // Adjusted size for better fit
            viewBox="0 0 18 18" // Original viewBox maintained for path data
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <g clipPath="url(#clip_footer_github)">
              <path
                d="M9 0C4.0275 0 0 4.13211 0 9.22838C0 13.3065 2.5785 16.7648 6.15375 17.9841C6.60375 18.0709 6.76875 17.7853 6.76875 17.5403C6.76875 17.3212 6.76125 16.7405 6.7575 15.9712C4.254 16.5277 3.726 14.7332 3.726 14.7332C3.3165 13.6681 2.72475 13.3832 2.72475 13.3832C1.9095 12.8111 2.78775 12.8229 2.78775 12.8229C3.6915 12.887 4.16625 13.7737 4.16625 13.7737C4.96875 15.1847 6.273 14.777 6.7875 14.5414C6.8685 13.9443 7.10025 13.5381 7.3575 13.3073C5.35875 13.0764 3.258 12.2829 3.258 8.74709C3.258 7.73988 3.60675 6.91659 4.18425 6.27095C4.083 6.03774 3.77925 5.0994 4.263 3.82846C4.263 3.82846 5.01675 3.58116 6.738 4.77462C7.458 4.56958 8.223 4.46785 8.988 4.46315C9.753 4.46785 10.518 4.56958 11.238 4.77462C12.948 3.58116 13.7017 3.82846 13.7017 3.82846C14.1855 5.0994 13.8818 6.03774 13.7917 6.27095C14.3655 6.91659 14.7142 7.73988 14.7142 8.74709C14.7142 12.2923 12.6105 13.0725 10.608 13.2995C10.923 13.5765 11.2155 14.1423 11.2155 15.0071C11.2155 16.242 11.2043 17.2344 11.2043 17.5341C11.2043 17.7759 11.3617 18.0647 11.823 17.9723C15.4237 16.7609 18 13.3002 18 9.22838C18 4.13211 13.9703 0 9 0Z"
                fill="#62748E"
              />
            </g>
            <defs>
              <clipPath id="clip_footer_github">
                <rect width={18} height={18} fill="white" />
              </clipPath>
            </defs>
          </svg>
        </a>
        <a
          href="https://x.com/nutlope"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center items-center w-5 h-5 rounded bg-white border-[0.3px] border-[#D1D5DC]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.79812 5.34371L9.92041 1.71429H9.18053L6.46944 4.86566L4.3041 1.71429H1.80664L5.08106 6.47972L1.80664 10.2857H2.54657L5.40955 6.95777L7.6963 10.2857H10.1938L6.79812 5.34371ZM5.78469 6.52171L5.45292 6.04718L2.81317 2.2713L5.14308 6.00001L7.71451 9.85715L9.18088 9.75405H8.04439L5.78469 6.52171Z"
              fill="#62748E"
            />
          </svg>
        </a>
      </div>
    </footer>
  );
}
