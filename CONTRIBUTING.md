# Contributing to domx

Thank you for your interest in contributing to domx! This document provides guidelines and information for contributors.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/domx.git`
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Build the project: `npm run build`

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Build successfully: `npm run build`
6. Commit your changes with a descriptive message
7. Push to your fork
8. Create a Pull Request

## Code Style

- Use pure functional JavaScript — no classes, no `this`
- Keep functions small and focused
- Add JSDoc comments for all public functions
- Use meaningful variable names
- Keep the bundle tiny (<1KB gzipped)

## Testing

domx uses BDD-style testing:

- **Vitest** - Unit tests with jsdom
- **Feature files** - BDD scenarios for documentation

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Guidelines

- Add unit tests for all new functionality
- Write BDD scenarios for user-facing features
- Ensure existing tests still pass
- Test edge cases and error conditions
- Use descriptive test names

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure CI checks pass
- Follow the existing patterns
- Keep PRs focused — one feature or fix per PR

## Architecture Principles

When contributing, please follow these core principles:

1. **DOM as Truth** - No JavaScript state duplication; read from DOM when needed
2. **Pure Functions** - No objects, no instances, no `this`
3. **Manifest Pattern** - Declarative state-to-DOM mapping
4. **Tiny Footprint** - <1KB gzipped, zero dependencies
5. **Security First** - No innerHTML, safe localStorage usage

## Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions. We aim for simplicity to focus on code — basic respect is assumed.

## Questions?

Feel free to open an issue for questions or discussions.
