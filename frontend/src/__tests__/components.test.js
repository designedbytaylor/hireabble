import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';

describe('UI Components', () => {
  describe('Button', () => {
    test('renders with text content', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    test('renders as a button element by default', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('passes through disabled prop', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    test('applies variant classes', () => {
      const { container } = render(<Button variant="destructive">Delete</Button>);
      expect(container.firstChild).toHaveClass('bg-destructive');
    });
  });

  describe('Badge', () => {
    test('renders with text content', () => {
      render(<Badge>Status</Badge>);
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('renders as a div element', () => {
      const { container } = render(<Badge>Test</Badge>);
      expect(container.firstChild.tagName).toBe('DIV');
    });
  });

  describe('Card', () => {
    test('renders Card with all sub-components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Content body')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });

    test('Card applies custom className', () => {
      const { container } = render(<Card className="custom-class">Test</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
