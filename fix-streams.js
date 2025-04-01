// Node.js 16環境下でのReadableStreamなど不足しているWebStreamsをポリフィルするためのヘルパー
const { Readable, Transform, Writable } = require('stream');

// グローバルオブジェクトにStreamクラスを追加
if (!global.ReadableStream) {
  global.ReadableStream = Readable;
  console.log('Added ReadableStream polyfill');
}

if (!global.TransformStream) {
  global.TransformStream = Transform;
  console.log('Added TransformStream polyfill');
}

if (!global.WritableStream) {
  global.WritableStream = Writable;
  console.log('Added WritableStream polyfill');
}

// その他のユーティリティメソッドをエミュレート
if (!global.ReadableStream.from) {
  global.ReadableStream.from = function(iterable) {
    const readable = new Readable({ objectMode: true });
    
    // 後でイテラブルの中身をプッシュする関数を定義
    const push = async () => {
      try {
        for await (const chunk of iterable) {
          if (!readable.push(chunk)) {
            // バックプレッシャーが適用された場合、再開を待つ
            return;
          }
        }
        // イテラブルの最後に到達したらnullをプッシュして終了
        readable.push(null);
      } catch (err) {
        readable.destroy(err);
      }
    };
    
    // データが読み取られたらプッシュを再開
    readable._read = () => {
      push();
    };
    
    // 初回プッシュを開始
    push();
    
    return readable;
  };
  
  console.log('Added ReadableStream.from polyfill');
}

console.log('Web Streams polyfill initialized successfully');

module.exports = {
  ReadableStream: global.ReadableStream,
  TransformStream: global.TransformStream,
  WritableStream: global.WritableStream
};