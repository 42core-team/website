import type { AxiosError } from 'axios'

export function getGamblingErrorMessage(error: Error) {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data.message ?? error.message
}

export function formatGamblingCredits(value: number) {
  return new Intl.NumberFormat().format(value)
}
