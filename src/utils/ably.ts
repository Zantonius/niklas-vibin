"server only";

import { Realtime } from 'ably';

export const createAblyClient = () => {
  return new Realtime({
    key: process.env.NEXT_PUBLIC_ABLY_API_KEY!,
  });
};
