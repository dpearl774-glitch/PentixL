/** Static host for the built Pentix app; unknown routes fall back to index.html. */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
