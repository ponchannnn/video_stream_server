FROM node:20-alpine

# FFmpegとタイムゾーンデータのインストール
RUN apk update && apk add --no-cache ffmpeg tzdata

# 作業ディレクトリの設定
WORKDIR /app

# パッケージ情報のコピーとインストール
COPY package.json ./
RUN npm install

# 実行コードのコピー
COPY server.js ./

# コンテナ起動時にサーバーを実行
CMD ["node", "server.js"]