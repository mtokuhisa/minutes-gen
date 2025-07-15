// FFmpeg モック
class FFmpeg {
  constructor() {
    this.loaded = false;
  }

  async load() {
    this.loaded = true;
    return Promise.resolve();
  }

  async writeFile(name, data) {
    return Promise.resolve();
  }

  async readFile(name) {
    return new Uint8Array([1, 2, 3, 4]); // ダミーデータ
  }

  async exec(args) {
    return Promise.resolve();
  }

  on(event, callback) {
    // イベントリスナーのモック
  }

  off(event, callback) {
    // イベントリスナー削除のモック
  }
}

module.exports = { FFmpeg }; 