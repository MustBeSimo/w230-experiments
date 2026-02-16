
import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'terracotta';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
  title
}) => {
  const variants = {
    // Primary is now Terracotta
    primary: 'bg-terracotta hover:bg-terracotta-hover text-white shadow-lg shadow-terracotta/20 border border-terracotta',
    // Secondary is Dark Beige/Sand
    secondary: 'bg-beige-300 hover:bg-beige-400 text-beige-900 border border-beige-400',
    // Danger is Rose
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20',
    // Ghost is transparent with dark text
    ghost: 'bg-transparent hover:bg-beige-200 text-beige-900 hover:text-black',
    // Specific Terracotta variant if needed explicitly
    terracotta: 'bg-terracotta hover:bg-terracotta-hover text-white'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
