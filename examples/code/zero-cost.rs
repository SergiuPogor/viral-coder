struct Parser<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }

    fn remaining(&self) -> &'a str {
        &self.input[self.pos..]
    }

    fn take_while(&mut self, pred: impl Fn(char) -> bool) -> &'a str {
        let start = self.pos;
        while self.pos < self.input.len() {
            if pred(self.input[self.pos..].chars().next().unwrap()) {
                self.pos += 1;
            } else {
                break;
            }
        }
        &self.input[start..self.pos]
    }

    fn skip_whitespace(&mut self) {
        self.take_while(|c| c.is_whitespace());
    }

    fn parse_key_value(&mut self) -> Option<(&'a str, &'a str)> {
        self.skip_whitespace();
        let key = self.take_while(|c| c != '=' && !c.is_whitespace());
        if key.is_empty() { return None; }
        self.skip_whitespace();
        self.pos += 1; // skip '='
        self.skip_whitespace();
        let value = self.take_while(|c| c != '\n' && c != ';');
        Some((key, value.trim()))
    }

    fn parse_all(&mut self) -> Vec<(&'a str, &'a str)> {
        std::iter::from_fn(|| self.parse_key_value()).collect()
    }
}

fn main() {
    let config = "host = 127.0.0.1\nport = 8080\nname = zero-copy";
    let entries = Parser::new(config).parse_all();
    entries.iter().for_each(|(k, v)| println!("{k}: {v}"));
}
