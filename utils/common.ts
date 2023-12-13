export const formatResponse = (code: number, message: string, data: { [key: string]: unknown }) => {
  return {
    code,
    message,
    data
  };
};
