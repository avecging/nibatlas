import { render, screen } from '@testing-library/react';
import { expect,it } from 'vitest';
import { ShopRelated } from './ShopRelated';
it('renders compact linked names, places and relationship labels; hides an empty section',()=>{
 const view=render(<ShopRelated headingId="related" shops={[]}/>);expect(screen.queryByRole('heading')).toBeNull();
 view.rerender(<ShopRelated headingId="related" shops={[{id:'one',slug:'synthetic-north',name:'Synthetic North',countryCode:'JP',localityName:'Kobe',kind:'branch'},{id:'two',slug:'synthetic-related',name:'Synthetic Related',countryCode:'SG',localityName:'Singapore',kind:'related'}]}/>);
 expect(screen.getByRole('link',{name:/Synthetic North/})).toHaveAttribute('href','/shops/synthetic-north');
 expect(screen.getByText('Kobe · Japan')).toBeInTheDocument();expect(screen.getByText('Branch')).toBeInTheDocument();
 expect(screen.getAllByText('Related shop')).toHaveLength(1);
});
