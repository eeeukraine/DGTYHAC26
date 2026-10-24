import { TextField } from '@mui/material';

export function Input({ label, ...props }) {
  return (
    <TextField
      label={label}
      variant="outlined"
      fullWidth
      size="small"
      {...props}
    />
  );
}