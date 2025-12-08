import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'white';
  icon?: string;
  label: string;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', icon, label, className, ...props }) => {
  const baseStyles = "flex flex-col items-center justify-center p-3 rounded-2xl transition-transform active:scale-95 shadow-md min-h-[70px] w-full";
  
  const variants = {
    primary: "bg-teal-600 text-white border-2 border-teal-700",
    secondary: "bg-orange-500 text-white border-2 border-orange-600",
    danger: "bg-red-600 text-white border-2 border-red-700",
    white: "bg-white text-slate-900 border-2 border-slate-200"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className || ''}`} 
      {...props}
    >
      {icon && <i className={`fa-solid fa-${icon} text-2xl mb-1`}></i>}
      <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
};

export default Button;
