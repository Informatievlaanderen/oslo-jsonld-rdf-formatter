# `OSLO JSON-LD RDF formatter`

> Given an RDF Turtle (.ttl) file and a JSON-LD context, this tool converts the Turtle data into a structured JSON-LD document

## Install

```
npm install @oslo-flanders/jsonld-rdf-formatter
```

## Global install

To use the service from the command line anywhere, you can install it globally.

```bash
npm install -g @oslo-flanders/jsonld-rdf-formatter
```

## API

The service is executed from the CLI and expects the following parameters:
| Parameter | Description | Required | Possible values |
| --------- | --------- | ----------- | --------------- |
| `--ttl-file` | Path to the input RDF Turtle file | :heavy_check_mark: | |
| `--context` | The URL or local file path of a JSON-LD context file | :heavy_check_mark: ||
| `-o, --output` | The name of the output file | No, defaults to `output.jsonld` ||

## Sidenote

The converter uses the n3 library to parse Turtle files and the jsonld library to perform RDF-to-JSON-LD conversion and compaction. The provided context must be a valid JSON-LD context document. If the context is not valid or cannot be fetched, the conversion will fail. Same for the Turtle file.

## Usage

```bash
ttl-to-jsonld MAGDA-GeefPersoon-REST-Voorbeeld-Wettelijke-Woonplaats.ttl persoon-im.jsonld
ttl-to-jsonld MAGDA-GeefPersoon-REST-Voorbeeld-Wettelijke-Woonplaats.ttl persoon-im.jsonld --output result.jsonld

```
