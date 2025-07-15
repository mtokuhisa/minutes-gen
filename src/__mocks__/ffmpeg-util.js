// FFmpeg util モック
const toBlobURL = jest.fn((url, mimeType) => {
  return Promise.resolve('blob:mock-url');
});

const fetchFile = jest.fn((input) => {
  if (input instanceof File) {
    return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
  }
  return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
});

module.exports = { toBlobURL, fetchFile }; 