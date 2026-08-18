package dev.jobtrackr.jobimport;

import org.jsoup.nodes.Document;

import java.net.URI;

record FetchedJobPage(URI url, Document document) {
}
