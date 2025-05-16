"server only";

import { Realtime } from 'ably';

export const createAblyClient = () => {
  return new Realtime({
    authUrl: "/api/ably/token",
  });
};
