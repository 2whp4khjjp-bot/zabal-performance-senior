export const todayKey = () => new Date().toISOString().slice(0, 10);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  );

export const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${value}T12:00:00`),
  );

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));

export const startOfWeekKey = () => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};
