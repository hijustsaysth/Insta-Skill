import type { InstagramProfileClient } from "./profile.js";
import type { InstagramMediaClient } from "./media.js";
import type { InstagramPublishClient } from "./publish.js";

export interface InstagramClient {
  profile: InstagramProfileClient;
  media: InstagramMediaClient;
  publish: InstagramPublishClient;
}
