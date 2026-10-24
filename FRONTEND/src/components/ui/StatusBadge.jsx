import { Chip } from '@mui/material';

export function StatusBadge({ status }) {
  const config = {
    paid: { label: 'Оплачено', color: 'success' },
    unpaid: { label: 'Не оплачено', color: 'warning' },
    overdue: { label: 'Просрочено', color: 'error' },
  };

  const { label, color } = config[status] || { label: status, color: 'default' };

  return <Chip label={label} color={color} size="small" />;
}