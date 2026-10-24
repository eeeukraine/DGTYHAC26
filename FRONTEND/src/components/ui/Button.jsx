import { Button as MuiButton } from '@mui/material';

export function Button({ colorVariant = 'primary', children, ...props }) {
  const colorMap = {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'error',
    success: 'success',
  };

  return (
    <MuiButton
      variant="contained"
      color={colorMap[colorVariant]}
      {...props}
    >
      {children}
    </MuiButton>
  );
}