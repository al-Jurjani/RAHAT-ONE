import React from 'react';
import './FormField.css';

function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required,
  disabled,
  name,
  id,
  rows,
  children,
  className = '',
}) {
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-');
  const isTextarea = type === 'textarea';
  const isSelect = type === 'select';
  const hasError = Boolean(error);

  const inputClass = [
    isTextarea ? 'form-field__textarea' : isSelect ? 'form-field__select' : 'form-field__input',
    hasError ? (isTextarea ? 'form-field__textarea--error' : isSelect ? 'form-field__select--error' : 'form-field__input--error') : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`form-field__label${required ? ' form-field__label--required' : ''}`}
        >
          {label}
        </label>
      )}

      {isTextarea ? (
        <textarea
          id={inputId}
          name={name}
          className={inputClass}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows || 4}
        />
      ) : isSelect ? (
        <select
          id={inputId}
          name={name}
          className={inputClass}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        >
          {children}
        </select>
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
          className={inputClass}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
      )}

      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export default FormField;
