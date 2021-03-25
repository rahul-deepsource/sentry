/**
 * This added layer is used so that we can force webpack to make a new chunk.
 *
 * The idea is that the "runtimeChunk" and this chunk will never be cached and they will
 * be used to load the SPA. We want minimal logic in here and let webpack do its magic
 * with creating the initial application chunks.
 */
function app() {
  // TODO(billy): Error handling?
  import(/* webpackChunkName: "init" */ './init');
}

app();
