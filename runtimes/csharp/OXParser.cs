using System.Text;

namespace OX;

/// <summary>
/// Tokenizes and parses OX source code into an AST.
/// </summary>
public class OXParser
{
    private readonly string _source;
    private readonly string _filename;
    private int _pos;
    private int _line = 1;
    private int _column = 1;
    private readonly List<Token> _tokens = new();

    public OXParser(string source, string filename = "<input>")
    {
        _source = source;
        _filename = filename;
    }

    public OXDocument Parse()
    {
        Tokenize();
        return ParseDocument();
    }

    // ============================================================================
    // Tokenizer
    // ============================================================================

    private void Tokenize()
    {
        while (!IsAtEnd())
        {
            SkipWhitespaceAndComments();
            if (IsAtEnd()) break;

            var token = ScanToken();
            if (token != null)
            {
                _tokens.Add(token);
            }
        }

        _tokens.Add(new Token { Type = TokenType.EOF, Location = GetLocation() });
    }

    private Token? ScanToken()
    {
        var location = GetLocation();
        var c = Current();

        return c switch
        {
            '[' => Advance('[', TokenType.LBRACKET, location),
            ']' => Advance(']', TokenType.RBRACKET, location),
            '(' => Advance('(', TokenType.LPAREN, location),
            ')' => Advance(')', TokenType.RPAREN, location),
            ':' => Advance(':', TokenType.COLON, location),
            ',' => Advance(',', TokenType.COMMA, location),
            '@' => Advance('@', TokenType.AT, location),
            '#' => Advance('#', TokenType.HASH, location),
            '"' => ScanString(location),
            '`' => ScanFreeTextOrError(location),
            _ when char.IsDigit(c) || (c == '-' && char.IsDigit(Peek())) => ScanNumber(location),
            _ when char.IsLetter(c) || c == '_' => ScanIdentifier(location),
            _ => throw new OXParseException($"Unexpected character: {c}", location)
        };
    }

    private Token Advance(char expected, TokenType type, OXLocation location)
    {
        Advance();
        return new Token { Type = type, Value = expected.ToString(), Location = location };
    }

    private Token ScanString(OXLocation location)
    {
        Advance(); // opening "
        var sb = new StringBuilder();

        while (!IsAtEnd() && Current() != '"')
        {
            if (Current() == '\\')
            {
                Advance();
                if (!IsAtEnd())
                {
                    var escaped = Current() switch
                    {
                        'n' => '\n',
                        't' => '\t',
                        'r' => '\r',
                        '\\' => '\\',
                        '"' => '"',
                        _ => Current()
                    };
                    sb.Append(escaped);
                    Advance();
                }
            }
            else
            {
                sb.Append(Current());
                Advance();
            }
        }

        if (IsAtEnd())
            throw new OXParseException("Unterminated string", location);

        Advance(); // closing "
        return new Token { Type = TokenType.STRING, Value = sb.ToString(), Location = location };
    }

    private Token ScanNumber(OXLocation location)
    {
        var start = _pos;
        if (Current() == '-') Advance();

        while (!IsAtEnd() && char.IsDigit(Current()))
            Advance();

        if (!IsAtEnd() && Current() == '.' && char.IsDigit(Peek()))
        {
            Advance(); // .
            while (!IsAtEnd() && char.IsDigit(Current()))
                Advance();
        }

        var value = _source[start.._pos];
        return new Token { Type = TokenType.NUMBER, Value = value, Location = location };
    }

    private Token ScanIdentifier(OXLocation location)
    {
        var start = _pos;
        while (!IsAtEnd() && (char.IsLetterOrDigit(Current()) || Current() == '_' || Current() == '-'))
            Advance();

        var value = _source[start.._pos];
        var type = value switch
        {
            "true" or "false" => TokenType.BOOLEAN,
            "null" => TokenType.NULL,
            _ => TokenType.IDENTIFIER
        };

        return new Token { Type = type, Value = value, Location = location };
    }

    private Token? ScanFreeTextOrError(OXLocation location)
    {
        if (Peek() == '`' && Peek(2) == '`')
        {
            return ScanFreeText(location);
        }
        throw new OXParseException("Single backtick not supported", location);
    }

    private Token ScanFreeText(OXLocation location)
    {
        // Count opening backticks
        int count = 0;
        while (!IsAtEnd() && Current() == '`')
        {
            count++;
            Advance();
        }

        var start = _pos;

        // Find matching closing backticks
        while (!IsAtEnd())
        {
            if (Current() == '`')
            {
                var savedPos = _pos;
                var savedLine = _line;
                var savedColumn = _column;
                var closeCount = 0;

                while (!IsAtEnd() && Current() == '`')
                {
                    closeCount++;
                    Advance();
                }

                if (closeCount == count)
                {
                    var content = _source[start..savedPos];
                    return new Token { Type = TokenType.FREE_TEXT_CONTENT, Value = Dedent(content), Location = location };
                }
            }
            else
            {
                Advance();
            }
        }

        throw new OXParseException("Unterminated free text block", location);
    }

    private string Dedent(string text)
    {
        // Simple dedent: trim leading/trailing whitespace
        return text.Trim();
    }

    private void SkipWhitespaceAndComments()
    {
        while (!IsAtEnd())
        {
            var c = Current();

            if (char.IsWhiteSpace(c))
            {
                Advance();
            }
            else if (c == '/' && Peek() == '/')
            {
                // Line comment
                while (!IsAtEnd() && Current() != '\n')
                    Advance();
            }
            else if (c == '/' && Peek() == '*')
            {
                // Block comment
                Advance(); // /
                Advance(); // *
                while (!IsAtEnd())
                {
                    if (Current() == '*' && Peek() == '/')
                    {
                        Advance(); // *
                        Advance(); // /
                        break;
                    }
                    Advance();
                }
            }
            else
            {
                break;
            }
        }
    }

    private bool IsAtEnd() => _pos >= _source.Length;

    private char Current() => IsAtEnd() ? '\0' : _source[_pos];

    private char Peek(int offset = 1)
    {
        var pos = _pos + offset;
        return pos >= _source.Length ? '\0' : _source[pos];
    }

    private void Advance()
    {
        if (IsAtEnd()) return;

        if (Current() == '\n')
        {
            _line++;
            _column = 1;
        }
        else
        {
            _column++;
        }

        _pos++;
    }

    private OXLocation GetLocation() => new() { File = _filename, Line = _line, Column = _column };

    // ============================================================================
    // Parser
    // ============================================================================

    private int _tokenPos = 0;

    private OXDocument ParseDocument()
    {
        var doc = new OXDocument();

        while (!CheckToken(TokenType.EOF))
        {
            if (CheckToken(TokenType.LBRACKET) || CheckToken(TokenType.AT) || CheckToken(TokenType.HASH))
            {
                doc.Blocks.Add(ParseBlock());
            }
            else
            {
                throw new OXParseException("Unexpected token at document level", CurrentToken().Location);
            }
        }

        return doc;
    }

    private OXBlock ParseBlock()
    {
        var tags = new List<OXTag>();

        // Parse tags
        while (CheckToken(TokenType.AT) || CheckToken(TokenType.HASH))
        {
            tags.Add(ParseTag());
        }

        var location = CurrentToken().Location;
        ExpectToken(TokenType.LBRACKET);

        // Parse optional identifier
        string? id = null;
        if (CheckToken(TokenType.IDENTIFIER))
        {
            id = AdvanceToken().Value;
        }

        // Parse properties
        var properties = new Dictionary<string, object?>();
        if (CheckToken(TokenType.LPAREN))
        {
            properties = ParseProperties();
        }

        // Parse children
        var children = new List<OXNode>();
        while (!CheckToken(TokenType.RBRACKET) && !CheckToken(TokenType.EOF))
        {
            if (CheckToken(TokenType.LBRACKET) || CheckToken(TokenType.AT) || CheckToken(TokenType.HASH))
            {
                children.Add(ParseBlock());
            }
            else if (CheckToken(TokenType.FREE_TEXT_CONTENT))
            {
                children.Add(ParseFreeText(tags));
            }
            else
            {
                throw new OXParseException("Unexpected token in block body", CurrentToken().Location);
            }
        }

        ExpectToken(TokenType.RBRACKET);

        return new OXBlock
        {
            Id = id,
            Properties = properties,
            Children = children,
            Tags = tags,
            Location = location
        };
    }

    private OXTag ParseTag()
    {
        var type = CheckToken(TokenType.AT) ? OXTagType.Declaration : OXTagType.Instance;
        AdvanceToken(); // @ or #

        var name = ExpectToken(TokenType.IDENTIFIER).Value!;

        string? argument = null;
        if (CheckToken(TokenType.LPAREN))
        {
            AdvanceToken(); // (
            argument = ExpectToken(TokenType.IDENTIFIER).Value;
            ExpectToken(TokenType.RPAREN);
        }

        return new OXTag { Type = type, Name = name, Argument = argument };
    }

    private Dictionary<string, object?> ParseProperties()
    {
        ExpectToken(TokenType.LPAREN);
        var props = new Dictionary<string, object?>();

        while (!CheckToken(TokenType.RPAREN) && !CheckToken(TokenType.EOF))
        {
            var key = ExpectToken(TokenType.IDENTIFIER).Value!;
            ExpectToken(TokenType.COLON);
            var value = ParseValue();
            props[key] = value;

            if (CheckToken(TokenType.COMMA))
                AdvanceToken();
        }

        ExpectToken(TokenType.RPAREN);
        return props;
    }

    private object? ParseValue()
    {
        var token = CurrentToken();

        return token.Type switch
        {
            TokenType.STRING => AdvanceToken().Value,
            TokenType.NUMBER => ParseNumber(AdvanceToken().Value!),
            TokenType.BOOLEAN => AdvanceToken().Value == "true",
            TokenType.NULL => (AdvanceToken(), (object?)null).Item2,
            TokenType.LBRACKET => ParseArray(),
            _ => throw new OXParseException($"Unexpected value token: {token.Type}", token.Location)
        };
    }

    private object ParseNumber(string value)
    {
        if (value.Contains('.'))
            return double.Parse(value);
        return long.Parse(value);
    }

    private List<object?> ParseArray()
    {
        ExpectToken(TokenType.LBRACKET);
        var elements = new List<object?>();

        while (!CheckToken(TokenType.RBRACKET) && !CheckToken(TokenType.EOF))
        {
            elements.Add(ParseValue());

            if (CheckToken(TokenType.COMMA))
                AdvanceToken();
        }

        ExpectToken(TokenType.RBRACKET);
        return elements;
    }

    private OXFreeText ParseFreeText(List<OXTag> tags)
    {
        var token = ExpectToken(TokenType.FREE_TEXT_CONTENT);
        return new OXFreeText
        {
            Content = token.Value!,
            Tags = tags,
            Location = token.Location
        };
    }

    private bool CheckToken(TokenType type) =>
        _tokenPos < _tokens.Count && _tokens[_tokenPos].Type == type;

    private Token CurrentToken() =>
        _tokenPos < _tokens.Count ? _tokens[_tokenPos] : _tokens[^1];

    private Token AdvanceToken() =>
        _tokens[_tokenPos++];

    private Token ExpectToken(TokenType type)
    {
        if (!CheckToken(type))
            throw new OXParseException($"Expected {type} but got {CurrentToken().Type}", CurrentToken().Location);
        return AdvanceToken();
    }
}

// ============================================================================
// Token Types
// ============================================================================

internal enum TokenType
{
    LBRACKET, RBRACKET, LPAREN, RPAREN,
    IDENTIFIER, STRING, NUMBER, BOOLEAN, NULL,
    COLON, COMMA, AT, HASH,
    FREE_TEXT_CONTENT, EOF
}

internal class Token
{
    public TokenType Type { get; set; }
    public string? Value { get; set; }
    public OXLocation Location { get; set; } = new();
}

public class OXParseException : Exception
{
    public OXLocation Location { get; }

    public OXParseException(string message, OXLocation location)
        : base($"{message} at {location.File}:{location.Line}:{location.Column}")
    {
        Location = location;
    }
}
