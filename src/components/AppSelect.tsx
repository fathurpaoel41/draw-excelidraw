import Select, { type StylesConfig } from "react-select";

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface AppSelectProps<T extends string | number> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  isSearchable?: boolean;
  className?: string;
  compact?: boolean;
}

function isDarkMode(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

export function AppSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Pilih...",
  isSearchable = false,
  className,
  compact = false,
}: AppSelectProps<T>) {
  const selected = options.find((opt) => opt.value === value) ?? null;

  const customStyles: StylesConfig<SelectOption<T>, false> = {
    control: (base, state) => {
      const dark = isDarkMode();
      return {
        ...base,
        minHeight: compact ? "28px" : "32px",
        height: compact ? "28px" : "32px",
        fontSize: "12px",
        fontFamily: "inherit",
        backgroundColor: dark ? "#18181d" : "#ffffff",
        borderColor: state.isFocused ? "#6965db" : dark ? "#3e3d4a" : "#d1d5db",
        borderRadius: "8px",
        boxShadow: "none",
        cursor: "pointer",
        "&:hover": {
          borderColor: "#6965db",
        },
      };
    },
    valueContainer: (base) => ({
      ...base,
      padding: "0 8px",
    }),
    input: (base) => {
      const dark = isDarkMode();
      return {
        ...base,
        margin: 0,
        padding: 0,
        color: dark ? "#e3e3e8" : "#1b1b1f",
      };
    },
    singleValue: (base) => {
      const dark = isDarkMode();
      return {
        ...base,
        color: dark ? "#e3e3e8" : "#1b1b1f",
        fontSize: "12px",
        fontWeight: 500,
      };
    },
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
      fontSize: "12px",
    }),
    indicatorSeparator: () => ({
      display: "none",
    }),
    dropdownIndicator: (base) => {
      const dark = isDarkMode();
      return {
        ...base,
        padding: "0 6px",
        color: dark ? "#9b9b9f" : "#6b7280",
        "&:hover": {
          color: dark ? "#e3e3e8" : "#1b1b1f",
        },
      };
    },
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base) => {
      const dark = isDarkMode();
      return {
        ...base,
        backgroundColor: dark ? "#232329" : "#ffffff",
        border: `1px solid ${dark ? "#31303b" : "#e5e7eb"}`,
        borderRadius: "8px",
        boxShadow: dark
          ? "0 8px 24px rgba(0, 0, 0, 0.45)"
          : "0 6px 20px rgba(0, 0, 0, 0.08)",
        overflow: "hidden",
        marginTop: "4px",
      };
    },
    menuList: (base) => ({
      ...base,
      padding: "4px",
    }),
    option: (base, state) => {
      const dark = isDarkMode();
      let backgroundColor = "transparent";
      if (state.isSelected) {
        backgroundColor = "#6965db";
      } else if (state.isFocused) {
        backgroundColor = dark ? "#2e2d39" : "#f1f0ff";
      }
      return {
        ...base,
        fontSize: "12px",
        fontWeight: state.isSelected ? 600 : 500,
        borderRadius: "6px",
        padding: "6px 8px",
        cursor: "pointer",
        backgroundColor,
        color: state.isSelected ? "#ffffff" : dark ? "#e3e3e8" : "#1b1b1f",
        "&:active": {
          backgroundColor: "#6965db",
          color: "#ffffff",
        },
      };
    },
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: "12px",
      color: "#9ca3af",
    }),
  };

  return (
    <div className={className}>
      <Select<SelectOption<T>, false>
        aria-label={ariaLabel}
        value={selected}
        options={options}
        onChange={(opt) => {
          if (opt) onChange(opt.value);
        }}
        placeholder={placeholder}
        isSearchable={isSearchable}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : null
        }
        menuPosition="fixed"
        styles={customStyles}
        noOptionsMessage={() => "Tidak ditemukan"}
      />
    </div>
  );
}
