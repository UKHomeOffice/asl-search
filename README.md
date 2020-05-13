# asl-search

## Setup

Start an elasticsearch instance:

```
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:7.6.2
```

Index the projects:

```
npm run index
```

Search:

```
npm run search -- <term>
```
