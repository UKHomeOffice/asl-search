# asl-search

## Setup

Start an elasticsearch instance:

```
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:7.8.0
```

Index all known models:

```
bin/indexer all
```

Index a specific model:

```
bin/indexer <model>
```

e.g.

```
bin/indexer profiles
```

Search:

```
bin/search -i <model> <searchterm>
```

e.g.

```
bin/search -i profiles dr
```
