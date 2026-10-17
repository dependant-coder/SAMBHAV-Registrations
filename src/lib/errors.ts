// ============================================================
// errors.ts — maps database error codes to user-friendly messages
// Source: spec section 13.1
// ============================================================

export interface ErrorInfo {
  message: string;
  /** Which form step the field lives in (1-indexed, undefined = toast/generic) */
  step?: number;
  /** Which field to focus (matches form field name) */
  field?: string;
}

export const ERROR_MESSAGES: Record<string, ErrorInfo> = {
  closed: {
    message: 'Registration is closed right now.',
  },
  name_not_found: {
    message: 'name_not_found',
    step: 1,
  },
  not_found: {
    message: 'name_not_found',
    step: 1,
  },
  already_registered: {
    message: 'already_registered',
    step: 1,
  },
  invalid_roll: {
    message: "That roll number doesn't look right. Use the exact number on your college ID, e.g. 21CO101.",
    step: 2,
    field: 'roll_number',
  },
  roll_taken: {
    message: 'This roll number is already registered by someone else. Check for a typo. If it\'s really yours, contact the core team.',
    step: 2,
    field: 'roll_number',
  },
  invalid_email: {
    message: 'Please enter a valid email address.',
    step: 2,
    field: 'email',
  },
  email_taken: {
    message: 'This email is already used by another registration. Use a different email address.',
    step: 2,
    field: 'email',
  },
  invalid_phone: {
    message: 'Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.',
    step: 2,
    field: 'phone',
  },
  invalid_alt_phone: {
    message: 'The alternate number must be a 10-digit mobile number, or leave it empty.',
    step: 2,
    field: 'alt_phone',
  },
  alt_same_as_phone: {
    message: 'The alternate number must be different from your main number, or leave it empty.',
    step: 2,
    field: 'alt_phone',
  },
  invalid_year: {
    message: 'Please choose your year from the list.',
    step: 2,
    field: 'year',
  },
  invalid_branch: {
    message: 'Please choose your branch from the list.',
    step: 2,
    field: 'branch',
  },
  invalid_photo: {
    message: 'Something went wrong with your photo. Please add it again.',
    step: 3,
    field: 'photo',
  },
  photo_missing: {
    message: 'Something went wrong with your photo. Please add it again.',
    step: 3,
    field: 'photo',
  },
  conflict: {
    message: "Something went wrong on our side. Your details are safe on this phone. Please try again in a minute.",
  },
  no_match: {
    message: "We couldn't find a registration with that roll number and email. Check both and try again.",
  },
  already_open: {
    message: 'You already have an open edit request. Use Check status.',
  },
  invalid_message: {
    message: 'Please write between 10 and 500 characters.',
    field: 'message',
  },
  not_unlocked: {
    message: "Editing isn't open for you right now. Send an edit request first, or your window may have ended.",
  },
  already_closed: {
    message: 'Someone already handled this request.',
  },
  not_admin: {
    message: 'This account does not have admin access.',
  },
};

export const NETWORK_ERROR: ErrorInfo = {
  message: "We couldn't confirm that your details were saved. Tap Submit again. It's safe, you won't be registered twice.",
};

export const GENERIC_ERROR: ErrorInfo = {
  message: "Something went wrong on our side. Your details are safe on this phone. Please try again in a minute.",
};

export function getError(code: string): ErrorInfo {
  return ERROR_MESSAGES[code] ?? GENERIC_ERROR;
}
