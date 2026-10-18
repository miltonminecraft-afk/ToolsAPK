package nl.tools.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HioIdentifierTest {
    @Test public void oneAndTwoLetterKvdNamesAreValid() {
        for (String name : new String[]{"A", "B", "AA", "AD", "AB"}) {
            assertEquals(name, HioScanActivity.HioParser.cleanKvdNameToken(name));
            assertEquals(name, HioScanActivity.HioParser.kvdNameFromLine("KVD " + name));
        }
    }
    @Test public void ocrMayOmitSpaceAfterKvdLabel() {
        assertEquals("A", HioScanActivity.HioParser.kvdNameFromLine("KVDA"));
        assertEquals("B", HioScanActivity.HioParser.kvdNameFromLine("KVDB"));
        assertEquals("AB", HioScanActivity.HioParser.kvdNameFromLine("KVDAB"));
    }
}
