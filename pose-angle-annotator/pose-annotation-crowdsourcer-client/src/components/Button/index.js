import "./Button.scss"

const Button = ({
  children,
  variant,
  disabled,
  width,
  padding,
  margin,
  onClick,
  style,
}) => {
  return (
    <div
      className={`button ${variant === "outline" ? "button--outline" : null} ${
        disabled ? "button--disabled" : null
      }`}
      onClick={!disabled ? onClick : null}
      style={{
        width: width || "100%",
        margin: margin || "0 0 6px 0",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default Button
