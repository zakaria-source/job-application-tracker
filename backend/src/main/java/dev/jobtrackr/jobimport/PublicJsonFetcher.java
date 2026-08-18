package dev.jobtrackr.jobimport;

import tools.jackson.databind.JsonNode;

import java.net.URI;

@FunctionalInterface
public interface PublicJsonFetcher {

    JsonNode fetch(URI uri);
}
