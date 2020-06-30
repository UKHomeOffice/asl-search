# asl-search

## Setup

Start an elasticsearch instance:

```
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:7.8.0
```

Index the projects:

```
npm run indexer
```

Search:

```
npm run search -- <term>
```
