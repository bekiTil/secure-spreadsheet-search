//! Generates the _OPEN_ME.html embedded inside every .companybundle.
//! Opens in any browser and guides the user to install the app —
//! no technical knowledge required.

// Template placeholders replaced at runtime:
//   __DATASET_NAME__   → dataset name (HTML-escaped)
//   __RECORD_COUNT__   → formatted record count
const TEMPLATE: &str = include_str!("open_me_template.html");

/// Returns the HTML bytes for the embedded install guide.
pub fn generate_open_me_html(dataset_name: &str, record_count: u64) -> Vec<u8> {
    let safe_name = dataset_name
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");

    TEMPLATE
        .replace("__DATASET_NAME__", &safe_name)
        .replace("__RECORD_COUNT__", &format_number(record_count))
        .into_bytes()
}

fn format_number(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 { out.push(','); }
        out.push(ch);
    }
    out.chars().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_html_generated() {
        let html = generate_open_me_html("Employee Data", 50_000);
        let s = String::from_utf8(html).unwrap();
        assert!(s.contains("Employee Data"));
        assert!(s.contains("50,000"));
        assert!(s.contains("<!DOCTYPE html>"));
    }

    #[test]
    fn test_html_escaping() {
        let html = generate_open_me_html("<script>alert(1)</script>", 1);
        let s = String::from_utf8(html).unwrap();
        assert!(!s.contains("<script>alert"));
        assert!(s.contains("&lt;script&gt;"));
    }

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(0), "0");
        assert_eq!(format_number(1000), "1,000");
        assert_eq!(format_number(1_234_567), "1,234,567");
    }
}
