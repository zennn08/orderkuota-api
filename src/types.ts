export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface PendingTransaction {
  id: string;
  username: string;
  base_amount: number;
  unique_suffix: number;
  final_amount: number;
  qris_string: string;
  created_at: number;
  expires_at: number;
}

export interface PaidTransaction {
  id: string;
  username: string;
  final_amount: number;
  paid_at: number;
  expires_at: number;
}

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'not_found';

/** Thrown by services/routes; mapped to an ApiResponse by the error middleware. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
